<script lang="ts">
  import { open, read, save, type CompatibleFileHandle } from "$lib/load";
  import { Tabs } from "bits-ui";
  import { HAND_TYPES, type HandType } from "$lib/game";

  let content = $state<any>();
  let fileHandle = $state<CompatibleFileHandle | null>(null);

  async function readFile() {
    fileHandle = await open();
    content = await read(fileHandle);
  }

  async function saveFile() {
    if (fileHandle) {
      save(fileHandle, content);
    }
  }

  function updateChipsAndMult(handType: HandType) {
    const handObj = content.GAME.hands[handType];
    handObj.mult = handObj.s_mult + (handObj.level - 1) * handObj.l_mult;
    handObj.chips = handObj.s_chips + (handObj.level - 1) * handObj.l_chips;
    console.log(handObj)
  }

  function titleToCamelCase(input: string): string {
    // Split by spaces, underscores, or hyphens
    const words = input.split(/[\s_-]+/);

    if (words.length === 0) return "";

    // Lowercase the first word, capitalize the rest
    const firstWord = words[0].toLowerCase();
    const rest = words
      .slice(1)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

    return [firstWord, ...rest].join("");
  }
</script>

<h1>Balatro Save Editor</h1>
<div class="mb-4">
  <button onclick={readFile}>Open</button>
  <button onclick={saveFile}>Save</button>
</div>

{#if content}
  <Tabs.Root value="edit">
    <Tabs.List>
      <Tabs.Trigger value="edit">Edit</Tabs.Trigger>
      <Tabs.Trigger value="raw">Raw</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="edit">
      <h4>Level</h4>
      <div>
        {#each HAND_TYPES as handType}
          <div class="mb-2">
            <label for="{titleToCamelCase(handType)}">{handType}</label>
            <input
              type="number"
              name="{handType}"
              id="{titleToCamelCase(handType)}"
              min="1"
              step="1"
              oninput={() => updateChipsAndMult(handType)}
              bind:value={content.GAME.hands[handType].level}
            />
          </div>
        {/each}
      </div>

      <h4>Money</h4>
      <div>
          <div class="mb-2">
            <label for="money">Money</label>
            <input
              type="number"
              name="money"
              id="money"
              min="1"
              step="1"
              bind:value={content.GAME.dollars}
            />
          </div>
      </div>
    </Tabs.Content>
    <Tabs.Content value="raw">
      <textarea
        cols="120"
        rows="60"
        name=""
        id=""
        value={JSON.stringify(content, null, 2)}
      ></textarea>
    </Tabs.Content>
  </Tabs.Root>
{/if}
