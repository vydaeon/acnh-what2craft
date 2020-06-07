package net.vydaeon.animalcrossing.what2craft;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

import static java.nio.file.FileSystems.newFileSystem;
import static java.nio.file.Files.isDirectory;
import static java.util.Collections.emptyMap;
import static java.util.Collections.unmodifiableMap;
import static java.util.stream.Collectors.toUnmodifiableMap;

@Repository
@RequiredArgsConstructor
@Slf4j
public class ItemRepository {

    private final Flux<Item> allItems =
            Flux.defer(() -> Flux.fromIterable(loadCraftingItemsById()))
                    .subscribeOn(Schedulers.boundedElastic())
                    .cache();

    private final ObjectMapper objectMapper;

    public Flux<Item> findAll() {
        return allItems;
    }

    private Iterable<Item> loadCraftingItemsById() {
        var allItemsById = loadAllItemsById();
        var craftingItems = new HashSet<Item>();
        allItemsById.values().stream()
                .filter(item -> item.getRecipe() != null)
                .peek(craftingItems::add)
                .flatMap(item -> item.getRecipe().keySet().stream())
                .map(getItem(allItemsById))
                .filter(Objects::nonNull)
                .forEach(craftingItems::add);
        return craftingItems;
    }

    @SneakyThrows
    private Map<String, Item> loadAllItemsById() {
        try (var itemPaths = Files.walk(getItemsPath(), 1)) {
            return itemPaths.filter(itemPath -> !isDirectory(itemPath))
                    .map(this::loadItemJson)
                    .filter(this::isNewHorizonsItem)
                    .map(this::toItem)
                    .collect(toUnmodifiableMap(Item::getId, Function.identity()));
        }
    }

    @SneakyThrows
    private Path getItemsPath() {
        var itemsUri = ItemRepository.class.getResource("/items").toURI();
        return "jar".equals(itemsUri.getScheme())
                ? newFileSystem(itemsUri, emptyMap()).getPath("/items")
                : Paths.get(itemsUri);
    }

    @SneakyThrows
    private JsonNode loadItemJson(Path path) {
        try (var reader = Files.newBufferedReader(path)) {
            return objectMapper.readTree(reader);
        }
    }

    private boolean isNewHorizonsItem(JsonNode itemNode) {
        return itemNode.path("games").hasNonNull("nh");
    }

    private Item toItem(JsonNode itemNode) {
        var id = itemNode.get("id").textValue();
        var name = itemNode.get("name").textValue();
        var buyPrice = getBuyPrice(itemNode);
        var sellPrice = getSellPrice(itemNode);
        var recipe = getRecipe(itemNode);
        return new Item(id, name, buyPrice, sellPrice, recipe);
    }

    private Integer getBuyPrice(JsonNode itemNode) {
        var buyPricesNode = itemNode.path("games").path("nh").path("buyPrices");
        if (buyPricesNode.size() > 1) {
            log.warn("item with multiple buy prices: " + itemNode);
        }

        var buyPriceNode = buyPricesNode.path(0).path("value");
        return buyPriceNode.isNumber() ? buyPriceNode.intValue() : null;
    }

    private Integer getSellPrice(JsonNode itemNode) {
        var sellPriceNode = itemNode.path("games").path("nh").path("sellPrice").path("value");
        return sellPriceNode.isNumber() ? sellPriceNode.intValue() : null;
    }

    private Map<String, Integer> getRecipe(JsonNode itemNode) {
        var recipeNode = itemNode.path("games").path("nh").path("recipe");
        if (!recipeNode.isObject()) {
            return null;
        }

        var recipe = new HashMap<String, Integer>();
        recipeNode.fields()
                .forEachRemaining(entry ->
                        recipe.put(entry.getKey(), entry.getValue().intValue()));
        return unmodifiableMap(recipe);
    }

    private Function<String, Item> getItem(Map<String, Item> allItemsById) {
        return itemId -> {
            var item = allItemsById.get(itemId);
            if (item == null) {
                log.warn("missing recipe ingredient with ID " + itemId);
                return new Item(itemId, itemId, null, null, null);
            }
            return item;
        };
    }
}
