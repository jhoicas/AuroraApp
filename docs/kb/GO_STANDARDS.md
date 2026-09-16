# Estandares Senior de Go

## Arquitectura

- Organiza el backend por capas y dominios: `domain` contiene entidades, reglas e interfaces; `application` coordina casos de uso; `infrastructure` implementa persistencia e integraciones; `handlers` adapta HTTP.
- Las dependencias apuntan hacia el dominio. El dominio no conoce Fiber, GORM, PostgreSQL, JWT ni proveedores de IA.
- Los casos de uso reciben dependencias por interfaces pequenas y explicitas. Usa constructores para validar dependencias obligatorias.
- Mantiene el aislamiento multi-tenant en el caso de uso y la persistencia; nunca confies solo en un filtro agregado por el handler.
- Los handlers validan entrada, autenticacion y formato de respuesta, pero no contienen reglas de negocio.

## Errores y concurrencia

- Devuelve errores con contexto usando wrapping (`fmt.Errorf("...: %w", err)`) y define errores de dominio centinela o tipos cuando el llamador necesita clasificarlos.
- No expongas detalles internos, SQL, tokens ni trazas en respuestas HTTP. Mapea errores de dominio a codigos HTTP en un unico lugar.
- Distingue errores esperables de infraestructura, validacion, autorizacion, conflicto y no encontrado.
- Toda goroutine debe tener propietario, condicion de salida y propagacion de cancelacion mediante `context.Context`.
- Evita data races; protege estado compartido con canales o mutex y ejecuta `go test -race ./...` cuando sea posible.
- Define timeouts para llamadas externas y libera siempre recursos (`defer Close`, rollback o cancelacion).

## Persistencia y seguridad

- Usa consultas parametrizadas y transacciones para operaciones atomicas. No construyas SQL con concatenacion de entrada del usuario.
- Cada consulta de datos tenant-scoped debe recibir y aplicar `tenant_id`; comprueba pertenencia antes de actualizar o eliminar.
- No registres secretos ni datos sensibles. Valida claims JWT y roles en middleware y vuelve a aplicar autorizacion en el caso de uso.
- Las migraciones deben ser repetibles cuando el proyecto lo permita, revisadas y acompanadas por pruebas de compatibilidad.

## Testing y calidad

- Prioriza pruebas unitarias de dominio y casos de uso; usa tablas de casos para reglas con muchas variantes.
- Usa `httptest` para handlers, dobles controlados para repositorios y pruebas de integracion para contratos con PostgreSQL/Supabase.
- Cubre exito, validacion, autorizacion, aislamiento entre tenants, errores de infraestructura, cancelacion y concurrencia relevante.
- Ejecuta `gofmt`, `go vet ./...` y `go test ./...`; agrega `-race` cuando el entorno lo soporte.
- Evita tests que dependan de tiempo real, orden accidental, red externa o estado global mutable.
