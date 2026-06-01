use super::*;

pub(super) async fn list_categories(pool: &DbPool) -> Result<Vec<Category>, String> {
    sqlx::query_as::<_, Category>("SELECT * FROM categories")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des catégories"))
}

pub(super) async fn insert_category(pool: &DbPool, category: Category) -> Result<(), String> {
    sqlx::query("INSERT OR IGNORE INTO categories (id, name, icon, color) VALUES ($1, $2, $3, $4)")
        .bind(category.id)
        .bind(category.name)
        .bind(category.icon)
        .bind(category.color)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "ajout de catégorie"))?;
    Ok(())
}

pub(super) async fn update_category(pool: &DbPool, category: Category) -> Result<(), String> {
    sqlx::query("UPDATE categories SET name = $1, icon = $2, color = $3 WHERE id = $4")
        .bind(category.name)
        .bind(category.icon)
        .bind(category.color)
        .bind(category.id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "mise à jour de catégorie"))?;
    Ok(())
}

pub(super) async fn delete_category(pool: &DbPool, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "suppression de catégorie"))?;
    Ok(())
}
