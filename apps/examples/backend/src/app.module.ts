import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ItemsModule } from './items/items.module';
import { VersionController } from './version.controller';

@Module({
  imports: [ItemsModule],
  controllers: [HealthController, VersionController],
})
export class AppModule {}
