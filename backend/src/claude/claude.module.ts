import { Module } from "@nestjs/common";
import { ClaudeCliService } from "./claude-cli.service";

@Module({
  providers: [ClaudeCliService],
  exports: [ClaudeCliService],
})
export class ClaudeModule {}
