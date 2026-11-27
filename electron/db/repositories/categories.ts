import type { Category, CategoryKind } from "../../../shared/models";
import { getDatabase } from "../connection";
import { DbError } from "../errors";
import { requireCategoryKind } from "../validation";

interface CategoryRow {
  id: string;
  name: string;
  kind: CategoryKind;
  is_default: number;
  created_at: string;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
  };
}

export function listCategories(kind?: CategoryKind): Category[] {
  const db = getDatabase();
  const filtered = requireCategoryKind(kind);

  if (filtered) {
    const rows = db
      .prepare(
        `SELECT id, name, kind, is_default, created_at
         FROM categories
         WHERE kind = ?
         ORDER BY name COLLATE NOCASE`,
      )
      .all(filtered) as CategoryRow[];
    return rows.map(mapCategory);
  }

  const rows = db
    .prepare(
      `SELECT id, name, kind, is_default, created_at
       FROM categories
       ORDER BY kind, name COLLATE NOCASE`,
    )
    .all() as CategoryRow[];
  return rows.map(mapCategory);
}

export function getCategoryById(id: string): Category | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT id, name, kind, is_default, created_at
       FROM categories WHERE id = ?`,
    )
    .get(id) as CategoryRow | undefined;
  return row ? mapCategory(row) : null;
}

export function requireCategoryOfKind(
  id: string,
  kind: CategoryKind,
): Category {
  const category = getCategoryById(id);
  if (!category) {
    throw new DbError("NOT_FOUND", "Categoría no encontrada");
  }
  if (category.kind !== kind) {
    throw new DbError(
      "VALIDATION",
      `La categoría debe ser de tipo ${kind}`,
    );
  }
  return category;
}
