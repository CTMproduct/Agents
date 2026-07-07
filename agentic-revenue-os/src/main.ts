import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Seguridad base: headers endurecidos + limites de payload + CORS controlado.
  // CSP se desactiva porque la consola y el marketplace son HTML inline servidos
  // por la propia API; al separar el frontend, activar CSP estricta.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.enableCors({
    origin: process.env.WEB_URL ?? true,
    credentials: true,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Agentic Revenue OS API corriendo en http://localhost:${port}`);
}
bootstrap();
