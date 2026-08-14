import { Module } from '@nestjs/common';

import { ReviewsModule } from '../reviews/reviews.module';
import { UsersService } from './application/users.service';
import { UserRepository } from './repositories/user.repository';
import { UsersController } from './users.controller';

@Module({
  imports: [ReviewsModule],
  controllers: [UsersController],
  providers: [UserRepository, UsersService],
  exports: [UserRepository],
})
export class UsersModule {}
