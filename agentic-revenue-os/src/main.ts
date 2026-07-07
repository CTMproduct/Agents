import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: necesario para verificar firmas HMAC de webhooks sobre los bytes
  // exactos recibidos (el body parser de Nest aplica su limite por defecto).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();

  // Seguridad base: headers endurecidos + CORS controlado.
  // CSP se desactiva porque la consola y el marketplace son HTML inline servidos
  // por la propia API; al separar el frontend, activar CSP estricta.
  app.use(helmet({ contentSecurityPolicy: false }));
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
