import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

const snake = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

/** Maps camelCase properties to snake_case columns (`createdAt` -> `created_at`). */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(className: string, customName?: string): string {
    return customName ?? snake(className);
  }

  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return (
      snake(embeddedPrefixes.concat('').join('_')) +
      (customName ?? snake(propertyName))
    );
  }

  relationName(propertyName: string): string {
    return snake(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snake(`${relationName}_${referencedColumnName}`);
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snake(`${tableName}_${columnName ?? propertyName}`);
  }
}
