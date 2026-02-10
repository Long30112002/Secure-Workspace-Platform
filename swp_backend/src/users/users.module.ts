import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/auth/auth.module';
import { ProfileController } from './controllers/profile.controller';
import { UserService } from './services/user.service';
import { ProfileService } from './services/profile.service';
import { DatabaseService } from 'src/database/database.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
  ],
  controllers: [
    UsersController,
    ProfileController,
  ],
  providers: [
    UserService,
    ProfileService,
    DatabaseService,
  ],
  exports: [
    UserService,
    ProfileService,
  ],
})
export class UsersModule { }
