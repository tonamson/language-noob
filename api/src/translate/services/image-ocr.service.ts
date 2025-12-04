import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { createWorker, createScheduler, Worker, Scheduler } from 'tesseract.js';
import sharp from 'sharp';
import { TextBox } from '../dto/image-translate.dto';

/**
 * Interface cho kết quả OCR từ Tesseract
 */
export interface OcrResult {
  box: TextBox;
  text: string;
  confidence: number;
}

/**
 * Interface cho word từ Tesseract
 */
interface TesseractWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

/**
 * Service xử lý OCR với Tesseract.js
 * Sử dụng worker pool để tối ưu hiệu suất xử lý song song
 */
@Injectable()
export class ImageOcrService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImageOcrService.name);
  private scheduler: Scheduler | null = null;
  private workers: Worker[] = [];
  private readonly WORKER_COUNT = 6; // Số worker trong pool
  private isInitialized = false;

  // Ngưỡng khoảng cách để tách words thành groups khác nhau (pixels)
  private readonly WORD_GAP_THRESHOLD = 50;
  // Ngưỡng khoảng cách dọc để coi là cùng dòng
  private readonly LINE_HEIGHT_THRESHOLD = 10;

  /**
   * Khởi tạo worker pool khi module được load
   */
  async onModuleInit(): Promise<void> {
    await this.initializeWorkerPool();
  }

  /**
   * Cleanup workers khi module bị destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.terminateWorkerPool();
  }

  /**
   * Khởi tạo Tesseract worker pool
   * Tạo nhiều worker để xử lý song song, tăng tốc độ OCR
   */
  private async initializeWorkerPool(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.logger.log(
        `Đang khởi tạo ${this.WORKER_COUNT} Tesseract workers...`,
      );

      this.scheduler = createScheduler();

      // Tạo workers song song để tăng tốc khởi tạo
      const workerPromises = Array.from(
        { length: this.WORKER_COUNT },
        async () => {
          const worker = await createWorker('eng+chi_sim+jpn+kor+vie', 1, {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                this.logger.debug(
                  `OCR progress: ${Math.round(m.progress * 100)}%`,
                );
              }
            },
          });
          return worker;
        },
      );

      this.workers = await Promise.all(workerPromises);

      // Thêm workers vào scheduler
      for (const worker of this.workers) {
        this.scheduler.addWorker(worker);
      }

      this.isInitialized = true;
      this.logger.log(
        `Đã khởi tạo thành công ${this.WORKER_COUNT} Tesseract workers`,
      );
    } catch (error) {
      this.logger.error('Lỗi khởi tạo Tesseract workers:', error);
      throw error;
    }
  }

  /**
   * Terminate tất cả workers trong pool
   */
  private async terminateWorkerPool(): Promise<void> {
    if (this.scheduler) {
      await this.scheduler.terminate();
      this.scheduler = null;
    }
    this.workers = [];
    this.isInitialized = false;
    this.logger.log('Đã terminate Tesseract worker pool');
  }

  /**
   * Đảm bảo worker pool đã được khởi tạo
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeWorkerPool();
    }
  }

  /**
   * Nhận diện text từ ảnh sử dụng Tesseract.js
   * Dùng words và merge các words gần nhau thành groups
   * Words cách xa nhau sẽ thành các boxes riêng (giống subtitle)
   * @param imageBuffer Buffer của ảnh cần OCR
   * @returns Danh sách các text groups với bounding box
   */
  async detectTextBlocks(imageBuffer: Buffer): Promise<OcrResult[]> {
    await this.ensureInitialized();

    if (!this.scheduler) {
      throw new Error('Tesseract scheduler chưa được khởi tạo');
    }

    const startTime = Date.now();
    this.logger.log('Bắt đầu nhận diện text từ ảnh...');

    try {
      // Tiền xử lý ảnh để tăng độ chính xác OCR
      const processedImage = await this.preprocessImage(imageBuffer);

      // Thực hiện OCR - lấy words
      const result = await this.scheduler.addJob(
        'recognize',
        processedImage,
        undefined,
        { blocks: true }, // blocks chứa paragraphs -> lines -> words
      );

      const data = result.data as any;
      this.logger.debug(`OCR data keys: ${Object.keys(data).join(', ')}`);

      // Thu thập tất cả words từ cấu trúc nested
      const allWords: TesseractWord[] = this.extractAllWords(data);

      this.logger.debug(`Tìm thấy ${allWords.length} words`);

      // Merge các words gần nhau thành groups
      const groups = this.mergeWordsIntoGroups(allWords);

      const duration = Date.now() - startTime;
      this.logger.log(
        `OCR hoàn thành trong ${duration}ms, tìm thấy ${groups.length} text groups`,
      );

      return groups;
    } catch (error) {
      this.logger.error('Lỗi khi OCR ảnh:', error);
      throw error;
    }
  }

  /**
   * Trích xuất tất cả words từ cấu trúc nested của Tesseract
   * Structure: blocks[] -> paragraphs[] -> lines[] -> words[]
   */
  private extractAllWords(data: any): TesseractWord[] {
    const words: TesseractWord[] = [];

    // Nếu có words trực tiếp
    if (data.words && Array.isArray(data.words)) {
      words.push(...data.words);
      return words;
    }

    // Duyệt qua cấu trúc nested
    const blocks = data.blocks || [];
    for (const block of blocks) {
      const paragraphs = block.paragraphs || [];
      for (const para of paragraphs) {
        const lines = para.lines || [];
        for (const line of lines) {
          const lineWords = line.words || [];
          for (const word of lineWords) {
            if (word.text && word.text.trim() && word.confidence > 30) {
              words.push({
                text: word.text.trim(),
                confidence: word.confidence,
                bbox: word.bbox,
              });
            }
          }
        }
      }
    }

    return words;
  }

  /**
   * Merge các words gần nhau thành groups
   * Words cách xa nhau (> WORD_GAP_THRESHOLD pixels) sẽ thành groups riêng
   * @param words Danh sách words
   * @returns Danh sách OcrResult (mỗi item là 1 group words)
   */
  private mergeWordsIntoGroups(words: TesseractWord[]): OcrResult[] {
    if (words.length === 0) return [];

    // Sort words theo vị trí: y trước (từ trên xuống), rồi x (từ trái qua)
    const sortedWords = [...words].sort((a, b) => {
      const yDiff = a.bbox.y0 - b.bbox.y0;
      // Nếu cùng dòng (y gần nhau), sort theo x
      if (Math.abs(yDiff) < this.LINE_HEIGHT_THRESHOLD) {
        return a.bbox.x0 - b.bbox.x0;
      }
      return yDiff;
    });

    const groups: OcrResult[] = [];
    let currentGroup: TesseractWord[] = [sortedWords[0]];

    for (let i = 1; i < sortedWords.length; i++) {
      const currentWord = sortedWords[i];
      const lastWord = currentGroup[currentGroup.length - 1];

      // Kiểm tra xem word hiện tại có cùng dòng và gần với group không
      const isSameLine =
        Math.abs(currentWord.bbox.y0 - lastWord.bbox.y0) <
        this.LINE_HEIGHT_THRESHOLD;
      const horizontalGap = currentWord.bbox.x0 - lastWord.bbox.x1;
      const isClose = horizontalGap < this.WORD_GAP_THRESHOLD;

      if (isSameLine && isClose) {
        // Thêm vào group hiện tại
        currentGroup.push(currentWord);
      } else {
        // Tạo group mới
        groups.push(this.createGroupFromWords(currentGroup));
        currentGroup = [currentWord];
      }
    }

    // Đừng quên group cuối cùng
    if (currentGroup.length > 0) {
      groups.push(this.createGroupFromWords(currentGroup));
    }

    return groups;
  }

  /**
   * Tạo OcrResult từ một nhóm words
   * @param words Nhóm words cần merge
   * @returns OcrResult với bounding box bao quanh tất cả words
   */
  private createGroupFromWords(words: TesseractWord[]): OcrResult {
    // Tính bounding box bao quanh tất cả words
    const x0 = Math.min(...words.map((w) => w.bbox.x0));
    const y0 = Math.min(...words.map((w) => w.bbox.y0));
    const x1 = Math.max(...words.map((w) => w.bbox.x1));
    const y1 = Math.max(...words.map((w) => w.bbox.y1));

    // Merge text
    const text = words.map((w) => w.text).join(' ');

    // Tính confidence trung bình
    const avgConfidence =
      words.reduce((sum, w) => sum + w.confidence, 0) / words.length;

    return {
      box: {
        x: x0,
        y: y0,
        width: x1 - x0,
        height: y1 - y0,
      },
      text,
      confidence: avgConfidence,
    };
  }

  /**
   * Tiền xử lý ảnh để tăng độ chính xác OCR
   * - Chuyển sang grayscale
   * - Tăng độ tương phản
   * - Normalize kích thước
   * @param imageBuffer Buffer ảnh gốc
   * @returns Buffer ảnh đã xử lý
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const processed = await sharp(imageBuffer)
        .grayscale() // Chuyển grayscale giúp OCR chính xác hơn
        .normalize() // Tăng độ tương phản
        .sharpen() // Làm sắc nét để chữ rõ hơn
        .png() // Output PNG để giữ chất lượng
        .toBuffer();

      return processed;
    } catch (error) {
      this.logger.warn('Không thể tiền xử lý ảnh, sử dụng ảnh gốc:', error);
      return imageBuffer;
    }
  }

  /**
   * Cắt một vùng từ ảnh theo bounding box
   * @param imageBuffer Buffer ảnh gốc
   * @param box Bounding box cần cắt
   * @returns Buffer ảnh đã cắt
   */
  async cropImageRegion(imageBuffer: Buffer, box: TextBox): Promise<Buffer> {
    try {
      const cropped = await sharp(imageBuffer)
        .extract({
          left: Math.max(0, Math.floor(box.x)),
          top: Math.max(0, Math.floor(box.y)),
          width: Math.ceil(box.width),
          height: Math.ceil(box.height),
        })
        .png()
        .toBuffer();

      return cropped;
    } catch (error) {
      this.logger.error(
        `Lỗi khi cắt ảnh tại box (${box.x}, ${box.y}, ${box.width}, ${box.height}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Chuyển đổi ảnh thành base64 để gửi cho vision model
   * @param imageBuffer Buffer ảnh
   * @returns Base64 string của ảnh
   */
  async imageToBase64(imageBuffer: Buffer): Promise<string> {
    // Đảm bảo ảnh ở định dạng PNG/JPEG
    const processed = await sharp(imageBuffer).png().toBuffer();

    return processed.toString('base64');
  }
}
