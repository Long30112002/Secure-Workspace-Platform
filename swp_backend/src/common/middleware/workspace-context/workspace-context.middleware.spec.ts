import { WorkspaceContextMiddleware } from './workspace-context.middleware';

describe('WorkspaceContextMiddleware', () => {
  it('should be defined', () => {
    expect(new WorkspaceContextMiddleware()).toBeDefined();
  });
});
