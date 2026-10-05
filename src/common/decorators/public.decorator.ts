import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global admin guard. Everything is protected by
 * default, so forgetting a decorator fails closed.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
