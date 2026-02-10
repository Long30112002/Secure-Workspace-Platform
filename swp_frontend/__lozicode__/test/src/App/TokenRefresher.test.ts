
import * as App from "../../../../src/App"
import { mockAll, readOutput } from '../../../../__lozicode__/mock';

mockAll();

describe("App.TokenRefresher", () =>  {
  it("default", async () => {
    const actualOutput = await App.TokenRefresher();
    console.log(actualOutput);
    // readOutput('App/TokenRefresher/default')
  });
})