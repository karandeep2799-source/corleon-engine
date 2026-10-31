import {describe,expect,it} from 'vitest';
import {applyTemplate,builtinTemplates} from './templates';
describe('image templates',()=>{
 it('replaces supplied template variables',()=>expect(applyTemplate('A {{subject}} on {{background}}',{subject:'red shoe',background:'white'})).toBe('A red shoe on white'));
 it('leaves missing variables empty',()=>expect(applyTemplate('A {{subject}}',{})).toBe('A '));
 it('provides unique built-in slugs',()=>expect(new Set(builtinTemplates.map(t=>t.slug)).size).toBe(builtinTemplates.length));
});
