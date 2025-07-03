import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Member-Portal backend running on http://localhost:${port}`);
}

bootstrap();