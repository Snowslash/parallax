// Material selection changes presentation only, never acquisition or frame data.
export function pixelBuffer(frame,mode){
  if(!['layered','uniform'].includes(mode))throw new RangeError('Unknown material mode');
  const pixels=mode==='layered'?frame.pixels:frame.uniformPixels;
  if(!(pixels instanceof Uint8ClampedArray)||pixels.length!==frame.width*frame.height*4)throw new Error('Incomplete comparison frame');
  return pixels;
}
