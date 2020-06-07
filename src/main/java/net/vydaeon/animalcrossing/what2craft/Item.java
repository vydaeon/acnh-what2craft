package net.vydaeon.animalcrossing.what2craft;

import lombok.Value;

import java.util.Map;

@Value
public class Item {

    String id;
    String name;
    Integer buyPrice;
    Integer sellPrice;
    Map<String, Integer> recipe;
}
