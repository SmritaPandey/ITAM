import { Controller, Post, Body, Req, HttpCode, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';

class ContactDto {
  name: string;
  email: string;
  subject: string;
  message: string;
  _honey?: string;  // honeypot field
}

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private service: ContactService) {}

  @Post()
  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Submit contact form (public, rate-limited)' })
  async submit(@Body() body: ContactDto, @Req() req: any) {
    // Honeypot check — bots fill hidden fields
    if (body._honey) {
      // Silently accept but don't store (fool the bot)
      return { success: true, message: 'Message received' };
    }

    // Basic validation
    if (!body.name?.trim() || !body.email?.trim() || !body.subject?.trim() || !body.message?.trim()) {
      throw new BadRequestException('All fields are required');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      throw new BadRequestException('Invalid email address');
    }

    try {
      await this.service.create({
        name: body.name,
        email: body.email,
        subject: body.subject,
        message: body.message,
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
      });
      return { success: true, message: 'Message received. We will get back to you within 24 hours.' };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Failed to submit');
    }
  }
}
