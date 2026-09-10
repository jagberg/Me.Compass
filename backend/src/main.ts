import "./load-env"; // MUST be first: loads root .env before anything reads process.env
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { runMigrations } from "./db/migrate";

async function bootstrap() {
  runMigrations();

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix("api");
  await app.register(require("@fastify/static"), {
    root: join(__dirname, "..", "public"),
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: "0.0.0.0" });
}

bootstrap();
