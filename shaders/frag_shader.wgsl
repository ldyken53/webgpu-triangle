// Fragment shader
[[group(0), binding(1)]] var myTexture: texture_2d<f32>;
[[group(0), binding(2)]] var mySampler: sampler;

[[stage(fragment)]]
fn main([[location(0)]] fragPosition: vec4<f32>) -> [[location(0)]] vec4<f32> {
    return textureSample(myTexture, mySampler, vec2<f32>(fragPosition.y, 0.5));
}
