import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';

/** Rejects malformed slugs before they reach the database. */
@Injectable()
export class SlugParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !/^[a-z0-9-]{1,64}$/.test(value)) {
      throw new NotFoundException({
        message: 'Card not found',
        code: 'CARD_NOT_FOUND',
      });
    }
    return value;
  }
}
