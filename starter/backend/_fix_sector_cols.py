from pathlib import Path

p = Path(r"internal/infrastructure/persistence/postgres/catalog_repository.go")
t = p.read_text(encoding="utf-8")
t2 = t.replace('Name: "code"', 'Name: "codigo"', 1)
t2 = t2.replace(
    '[]string{"name", "application", "observations", "updated_at"}',
    '[]string{"nombre", "aplicacion", "observaciones", "updated_at"}',
    1,
)
t2 = t2.replace("el mismo code.", "el mismo codigo.", 1)
print("changed:", t != t2)
p.write_text(t2, encoding="utf-8")
