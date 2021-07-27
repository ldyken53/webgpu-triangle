(async () => {
    if (!navigator.gpu) {
        document.getElementById("webgpu-canvas").setAttribute("style", "display:none;");
        document.getElementById("no-webgpu").setAttribute("style", "display:block;");
        return;
    }

    // Get a GPU device to render with
    var adapter = await navigator.gpu.requestAdapter();
    var device = await adapter.requestDevice();

    // Get a context to display our rendered image on the canvas
    var canvas = document.getElementById("webgpu-canvas");
    var context = canvas.getContext("webgpu");

    // Setup shader modules
    var vertModule = device.createShaderModule({ code: vert_shader });
    var vertex = {
        module: vertModule,
        entryPoint: "main",
        buffers: [
            {
                arrayStride: 4 * 4,
                attributes: [
                    {
                        format: "float32x4",
                        offset: 0,
                        shaderLocation: 0,
                    }
                ],
            },
        ],
    }

    var fragModule = device.createShaderModule({ code: frag_shader });

    var dataBuf = device.createBuffer({
        size: 6 * 4 * 4,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
    });
    // Interleaved positions and colors
    new Float32Array(dataBuf.getMappedRange()).set([
        1, -1, 0, 1,  // position
        -1, -1, 0, 1, // position
        -1, 1, 0, 1,   // position
        1, -1, 0, 1,  // position
        -1, 1, 0, 1, // position
        1, 1, 0, 1,   // position
    ]);
    dataBuf.unmap();


    // Setup render outputs
    var swapChainFormat = "bgra8unorm";
    context.configure({
        device: device,
        format: swapChainFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    var depthFormat = "depth24plus-stencil8";
    var depthTexture = device.createTexture({
        size: {
            width: canvas.width,
            height: canvas.height,
            depth: 1
        },
        format: depthFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    var renderPipeline = device.createRenderPipeline({
        vertex: vertex,
        fragment: {
            module: fragModule,
            entryPoint: "main",
            targets: [
                {
                    format: swapChainFormat
                },
            ],
        },
        primitive: {
            topology: 'triangle-list',
        },
        depthStencil: {
            format: depthFormat,
            depthWriteEnabled: true,
            depthCompare: "less",
        },
    });

    var renderPassDesc = {
        colorAttachments: [{
            view: undefined,
            loadValue: [0.3, 0.3, 0.3, 1]
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthLoadValue: 1.0,
            depthStoreOp: "store",
            stencilLoadValue: 0,
            stencilStoreOp: "store"
        }
    };

    // Load the default colormap and upload it
    var colormapImage = new Image();
    colormapImage.src = "colormaps/rainbow.png";
    await colormapImage.decode();
    const imageBitmap = await createImageBitmap(colormapImage);
    var colorTexture = device.createTexture({
        size: [imageBitmap.width, imageBitmap.height, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.SAMPLED | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: colorTexture },
        [imageBitmap.width, imageBitmap.height, 1]
    );
    var adjacencyMatrix = [];
    var matrixSize = 1000;
    adjacencyMatrix.push(matrixSize);
    for (var i = 0; i < matrixSize; i++) {
        for (var j = 0; j < matrixSize; j++) {
            adjacencyMatrix.push(0);
        }
    }
    for (var i = 0; i < matrixSize; i++) {
        for (var j = 0; j < i; j++) {
            var x = Math.random();
            adjacencyMatrix[i + matrixSize * j + 1] = x;
            adjacencyMatrix[j + matrixSize * i + 1] = x;
        }
    }
    console.log(adjacencyMatrix);
    this.matrixBuffer = device.createBuffer({
        size: 134217728,
        usage: GPUBufferUsage.STORAGE,
        mappedAtCreation: true,
    });
    new Float32Array(this.matrixBuffer.getMappedRange()).set(adjacencyMatrix);
    this.matrixBuffer.unmap();

    // Create a buffer to store the view parameters
    var viewParamsBuffer = device.createBuffer({
        size: 16 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create a bind group which places our view params buffer at binding 0
    var bindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: viewParamsBuffer
                }
            },
            {
                binding: 1,
                resource: colorTexture.createView(),
            },
            {
                binding: 2,
                resource: {
                    buffer: matrixBuffer,
                }
            },
        ]
    });

    // Create an arcball camera and view projection matrix
    var camera = new ArcballCamera([0, 0, 3], [0, 0, 0], [0, 1, 0],
        0.5, [canvas.width, canvas.height]);
    var projection = mat4.perspective(mat4.create(), 50 * Math.PI / 180.0,
        canvas.width / canvas.height, 0.1, 100);
    // Matrix which will store the computed projection * view matrix
    var projView = mat4.create();

    // Controller utility for interacting with the canvas and driving
    // the arcball camera
    var controller = new Controller();
    controller.mousemove = function (prev, cur, evt) {
        if (evt.buttons == 1) {
            camera.rotate(prev, cur);

        } else if (evt.buttons == 2) {
            camera.pan([cur[0] - prev[0], prev[1] - cur[1]]);
        }
    };
    controller.wheel = function (amt) { camera.zoom(amt * 0.5); };
    controller.registerForCanvas(canvas);

    // Not covered in the tutorial: track when the canvas is visible
    // on screen, and only render when it is visible.
    var canvasVisible = false;
    var observer = new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) {
            canvasVisible = true;
        } else {
            canvasVisible = false;
        }
    }, { threshold: [0] });
    observer.observe(canvas);

    var frame = function () {
        if (canvasVisible) {
            renderPassDesc.colorAttachments[0].view =
                context.getCurrentTexture().createView();

            // Upload the combined projection and view matrix
            projView = mat4.mul(projView, projection, camera.camera);
            var upload = device.createBuffer({
                size: 16 * 4,
                usage: GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            });
            new Float32Array(upload.getMappedRange()).set(projView);
            upload.unmap();

            var commandEncoder = device.createCommandEncoder();

            // Copy the upload buffer to our uniform buffer
            commandEncoder.copyBufferToBuffer(upload, 0, viewParamsBuffer, 0, 16 * 4);

            var renderPass = commandEncoder.beginRenderPass(renderPassDesc);

            renderPass.setPipeline(renderPipeline);
            renderPass.setVertexBuffer(0, dataBuf);
            renderPass.setBindGroup(0, bindGroup);
            renderPass.draw(6, 1, 0, 0);

            renderPass.endPass();
            device.queue.submit([commandEncoder.finish()]);
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
