import { Controller, Get, All, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Request, Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @All('*')
  catchAll(@Req() req: Request, @Res() res: Response) {
    return res.status(404).json({
      statusCode: 404,
      message: `Cannot ${req.method} ${req.url}`,
      error: 'Not Found'
    });
  }
}
