import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { MarketSearchModule } from './market-search/market-search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MarketSearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
