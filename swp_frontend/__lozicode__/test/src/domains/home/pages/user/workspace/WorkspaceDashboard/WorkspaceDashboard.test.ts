
import * as WorkspaceDashboard from "../../../../../../../../../src/domains/home/pages/user/workspace/WorkspaceDashboard"
import { mockAll, readOutput } from '../../../../../../../../../__lozicode__/mock';

mockAll();

describe("WorkspaceDashboard.WorkspaceDashboard", () =>  {
  it("default", async () => {
    const actualOutput = await WorkspaceDashboard.WorkspaceDashboard();
    console.log(actualOutput);
    // readOutput('WorkspaceDashboard/WorkspaceDashboard/default')
  });
})