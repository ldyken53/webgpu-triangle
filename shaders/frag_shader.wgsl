// Fragment shader
[[block]] struct Matrix {
    size : f32;
    numbers: array<f32>;
};

[[group(0), binding(1)]] var myTexture: texture_2d<f32>;
[[group(0), binding(2)]] var<storage, read> adjacencyMatrix : Matrix;

[[stage(fragment)]]
fn main([[location(0)]] fragPosition: vec4<f32>) -> [[location(0)]] vec4<f32> {
    var ufragPos : vec4<u32> = vec4<u32>(fragPosition * adjacencyMatrix.size);
    var pixelIndex : u32 = ufragPos.x + ufragPos.y * u32(adjacencyMatrix.size);
    var value : f32 = adjacencyMatrix.numbers[pixelIndex];
    return textureLoad(myTexture, vec2<i32>(i32(value * 180.0), 1), 0);
}
