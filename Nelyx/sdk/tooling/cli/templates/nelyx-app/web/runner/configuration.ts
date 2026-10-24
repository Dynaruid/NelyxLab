import type {WebApplicationOptions} from '@nelyx/sdk/platforms/web/application';
let options:Omit<WebApplicationOptions,'canvas'|'input'|'button'>;
export function configure(value:typeof options){options=value;}
export function applicationOptions(){if(!options)throw new Error('Configure the Web runner before mounting');return options;}
