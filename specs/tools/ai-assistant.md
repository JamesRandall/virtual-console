# AI Assistant

Begin by reading these files:

/Users/jamesrandall/code/virtual-console/specs/hardware/cpu.md
/Users/jamesrandall/code/virtual-console/specs/hardware/memory-layout.md
/Users/jamesrandall/code/virtual-console/specs/hardware/video.md
/Users/jamesrandall/code/virtual-console/specs/tools/assembler.md
/Users/jamesrandall/code/virtual-console/specs/typescript-guide.md
/Users/jamesrandall/code/virtual-console/src/devkit/react-guidelines.md
/Users/jamesrandall/code/virtual-console/src/devkit/*
/Users/jamesrandall/code/virtual-console/src/console/src/*

I want us to add an AI assistant to the devkit that can help understand and write code and debug things. We can use Ollama in which I already have the qwen3-coder:30b model installed. I want us to add:

* A simple "chat" UI to the devkit which should appear in a sidebar at the right of the devkit.
    - Their should be a "new chat" button that resets the context window and starts again
    - When a new chat is started I want to "seed" the chat with some knowledge:
        a. A cheatsheet that describes the hardware: /Users/jamesrandall/code/virtual-console/specs/ai-cheatsheet.json
        b. Working example code:
            /Users/jamesrandall/code/virtual-console/src/examples/assembly/smiley2.asm
            /Users/jamesrandall/code/virtual-console/src/examples/assembly/drawPixel.asm
            /Users/jamesrandall/code/virtual-console/src/examples/assembly/animatedStarfieldWithVblank.asm
    - Ideally we would use a prebuilt component such as ChatBotKit: https://github.com/chatbotkit/node-sdk/tree/main/packages/react
    - It should support the handling of streamed responses
* A node API that can communicate with Ollama and host our (MCP?) tools. In response to a chat request this is able to run an agent to respond to the users request consuming tools as appropriate. The agents progress should be communicated back to the chat interface in the browser over the socket connection ideally using streaming responses.
* A websocket connection between the browser and the node API that allows the tools in the node API to interact with and control the devkit

I want to add tools that:

* Can read the current source assembly file including the current cursor position and selection
* Can update the source assembly file
* Can read the CPU state (registers, flags, etc.) and the memory
* Can set breakpoints
* Can perform "step" in the debugger
* Can perform "run" in the debugger
* Can reset the console
* Can invoke an assembly of the source code

State should be synced between the tools and the devkit when the AI requires it. The tools can run in the API service and invoke actions over the socket connection.

A candidate architecture diagram has been supplied along with this prompt.

There is no need to worry about security for the moment. This is only running locally.

The node app is new and should be created in the folder script in the folder /Users/jamesrandall/code/virtual-console/src/devkit/api

As part of the implementation create a script that will start everything up: Ollama, the API and the DevKit. Create this script in the folder /Users/jamesrandall/code/virtual-console/src/devkit

Provide a plan for the implementation.