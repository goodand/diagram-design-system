import test from 'node:test';
import assert from 'node:assert/strict';
import {viewStem} from './view-names.mjs';
test('view names follow purpose, independent of extension',()=>{
 for(const [type,expected] of Object.entries({Function_Definition:'function.common',Process_Summary_Linear:'summary.common',Process_Summary_Router:'summary.common',Process_Core:'core.human',Process_Full:'full.human'}))assert.equal(viewStem(type),expected);
 assert.equal(viewStem('Process_Core','agent'),'core.agent');
 assert.equal(viewStem('l1_partial'),'core.human');
 assert.equal(viewStem(undefined),'diagram');
});
