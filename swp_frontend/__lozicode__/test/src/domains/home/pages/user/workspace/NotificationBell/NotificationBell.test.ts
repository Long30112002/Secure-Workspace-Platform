
import * as NotificationBell from "../../../../../../../../../src/domains/home/pages/user/workspace/NotificationBell"
import { mockAll, readOutput } from '../../../../../../../../../__lozicode__/mock';

mockAll();

describe("NotificationBell.NotificationBell", () =>  {
  it("default", async () => {
    const actualOutput = await NotificationBell.NotificationBell();
    console.log(actualOutput);
    // readOutput('NotificationBell/NotificationBell/default')
  });
})