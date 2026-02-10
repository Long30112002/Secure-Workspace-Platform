import { Module } from '@nestjs/common';
import { UserManagementController } from './user-management/controller/user-management.controller';
import { UserManagementService } from './user-management/service/user-management.service';
import { UserManagementModule } from './user-management/user-management.module';
import { UsersModule } from 'src/users/users.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [UserManagementModule, UsersModule, DatabaseModule],
  controllers: [UserManagementController],
  providers: [UserManagementService],
  exports: [UserManagementService],
})
export class AdminModule { }
