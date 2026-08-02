import { Controller, Get } from '@nestjs/common';
import { WordsService, type DailyWordsDto } from './words.service';

@Controller('words')
export class WordsController {
  constructor(private readonly words: WordsService) {}

  @Get('today')
  getToday(): Promise<DailyWordsDto> {
    return this.words.getToday();
  }
}
