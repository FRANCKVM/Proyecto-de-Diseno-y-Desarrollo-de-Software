# Proyecto-de-Diseno-y-Desarrollo-de-Software

Sistema orientado a la planificacion y replanificacion de rutas aereas para el transporte de maletas implementado en Java, haciendo uso de algoritmos metaheuristicos.

## Ejecutar con Docker

Requisitos:

- Docker
- Docker Compose

Comando:

```bash
docker compose up --build
```

Abrir:

```txt
Frontend: http://localhost:5173
Backend:  http://localhost:8080/api
MySQL:    localhost:3306
```

Para detener:

```bash
docker compose down
```

Para reiniciar la base de datos desde cero:

```bash
docker compose down -v
docker compose up --build
```
