# Proyecto-de-Diseno-y-Desarrollo-de-Software

Sistema orientado a la planificacion y replanificacion de rutas aereas para el transporte de maletas implementado en Java, haciendo uso de algoritmos metaheuristicos.

**Stack:** Java 21 + Spring Boot 3 (backend) · React + TypeScript + Vite (frontend) · MySQL 8 · Docker Compose

---

## Despliegue en máquinas virtuales del Lab V (PUCP)

### Requisitos previos en el servidor

- Docker y Docker Compose instalados
- Acceso SSH a la VM asignada
- El servidor tiene Tomcat corriendo en el puerto 8080 — se debe detener antes de levantar los contenedores

### Pasos

**1. Clonar el repositorio (rama `despliegue`)**

```bash
git clone -b despliegue https://github.com/FRANCKVM/Proyecto-de-Diseno-y-Desarrollo-de-Software.git
cd Proyecto-de-Diseno-y-Desarrollo-de-Software
```

**2. Configurar nginx del servidor (solo la primera vez)**

```bash
sudo cp nginx-pucp.conf /etc/nginx/sites-available/tasfb2b
sudo ln -sf /etc/nginx/sites-available/tasfb2b /etc/nginx/sites-enabled/tasfb2b
sudo nginx -t && sudo systemctl reload nginx
```

**3. Levantar los contenedores**

El servidor PUCP tiene Tomcat que ocupa el puerto 8080. Hay que liberarlo antes de cada arranque:

```bash
sudo docker compose down
sudo fuser -k 8080/tcp
sudo docker compose up -d --build
```

**4. Verificar que todo esté corriendo**

```bash
sudo docker compose ps
sudo docker compose logs backend --tail=20
```

El backend tarda ~60-90 segundos en iniciar completamente.

**5. Acceder a la aplicación**

```
http://<alias-asignado-por-el-lab>
```

Por ejemplo: `http://1inf54-981-6f.inf.pucp.edu.pe`

### Notas importantes sobre el servidor PUCP

- El `docker-compose.yml` de la rama `despliegue` incluye IPs estáticas y `extra_hosts` para evitar problemas con el DNS interno de Docker en los servidores del Lab V.
- MySQL se expone en el puerto `3307` del host (internamente sigue siendo 3306) para evitar conflictos con instalaciones locales de MySQL.
- El script de espera en el entrypoint del backend (`until /dev/tcp/mysql/3306`) garantiza que Spring Boot no inicie hasta que MySQL esté listo.
- Si Tomcat reinicia automáticamente y ocupa el puerto 8080, repetir: `sudo fuser -k 8080/tcp && sudo docker compose up -d`

---

## Ejecutar localmente con Docker

**Requisitos:** Docker Desktop

```bash
docker compose up --build
```

Acceder en:

```
Frontend: http://localhost:5173
Backend:  http://localhost:8080/api
MySQL:    localhost:3307
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
