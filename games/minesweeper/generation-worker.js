import {generateBoard} from './board-generator.js';
self.onmessage=({data})=>{const {id,...options}=data;try{self.postMessage({id,result:generateBoard(options)});}catch(error){self.postMessage({id,error:error.message});}};
