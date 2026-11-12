import {resolve,sep} from 'node:path';
export function staticPath(root,pathname){if(pathname.split(/[\\/]/).includes('..'))return null;root=resolve(root);const p=resolve(root,'.'+pathname);return p===root||p.startsWith(root+sep)?p:null;}
