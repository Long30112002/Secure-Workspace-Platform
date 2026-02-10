import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceManagementController } from './workspace-management.controller';

describe('WorkspaceManagementController', () => {
  let controller: WorkspaceManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceManagementController],
    }).compile();

    controller = module.get<WorkspaceManagementController>(WorkspaceManagementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
