
import * as WorkspaceInvitationPage from "../../../../../../../../../src/domains/home/pages/user/workspace/WorkspaceInvitationPage"
import { mockAll, readOutput } from '../../../../../../../../../__lozicode__/mock';

mockAll();

describe("WorkspaceInvitationPage.WorkspaceInvitationPage", () =>  {
  it("default", async () => {
    const actualOutput = await WorkspaceInvitationPage.WorkspaceInvitationPage();
    console.log(actualOutput);
    // readOutput('WorkspaceInvitationPage/WorkspaceInvitationPage/default')
  });
})