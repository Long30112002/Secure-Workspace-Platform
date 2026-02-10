import * as WorkspaceDashboard from "../src/domains/home/pages/user/workspace/WorkspaceDashboard";
import { mock, init } from './core';
import * as fse from 'fs-extra';


export function mockAll() {
  mock(WorkspaceDashboard, {
    functionName: 'WorkspaceDashboard', targetName: 'WorkspaceDashboard'
  });

  
  
  
  
  
  
  init();
}

export function readOutput(path) {
  const outputPath = `output/${path}`;
  if(fse.existsSync(`${outputPath}.html`)) {
    return fse.readFileSync(`${outputPath}.html`);
  }
  if(fse.existsSync(`${outputPath}.json`)) {
    return fse.readJsonSync(`${outputPath}.json`);
  }
}

