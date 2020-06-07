var model = {
    allItemsById: {},
    ingredients: [],
    ingredientQuantities: {},
    hotItemIds: ["", ""],
    allRecipes: [],
    hiddenRecipeIds: []
};

var controller = function () {
    var getCost = function (itemId, previousItemIds) {
        var item = model.allItemsById[itemId];
        if (!item) {
            return 1;
        } else if (item.recipe.length > 0 && !previousItemIds.includes(itemId)) {
            var costSum = 0;
            previousItemIds.push(itemId);
            item.recipe.forEach(function (ingredient) {
                var quantity = ingredient.quantity;
                costSum += getCost(ingredient.itemId, previousItemIds) * quantity;
            });
            previousItemIds.pop();
            return costSum;
        } else if (!item.buyPrice) {
            return item.sellPrice ? item.sellPrice : 1;
        } else {
            return item.buyPrice;
        }
    };
    var getNestedRecipe = function (itemId, previousItemIds) {
        var item = model.allItemsById[itemId];
        if (!item || previousItemIds.includes(itemId)) {
            return [];
        }

        previousItemIds.push(itemId);
        var recipe = item.recipe.map(function (ingredient) {
            return {
                itemId: ingredient.itemId,
                quantity: ingredient.quantity,
                recipe: getNestedRecipe(ingredient.itemId, previousItemIds)
            };
        });
        previousItemIds.pop();
        return recipe;
    };
    var sortRecipes = function () {
        model.allRecipes.sort(function (r1, r2) {
            if (r1.markup != r2.markup) {
                return r2.markup - r1.markup;
            } else if (r1.profit != r2.profit) {
                return r2.profit - r1.profit;
            } else {
                return r1.name > r2.name ? 1 : -1;
            }
        });
    };
    var onSellPriceUpdated = function (item) {
        item.profit = item.sellPrice - item.cost;
        item.markup = (item.sellPrice / item.cost).toFixed(2);
    };
    m.request("/items").then(function (allItems) {
        allItems.forEach(function (item) {
            model.allItemsById[item.id] = item;
            if (item.recipe) {
                item.recipe = Object.keys(item.recipe).map(function (ingredientItemId) {
                    return {
                        itemId: ingredientItemId,
                        quantity: item.recipe[ingredientItemId]
                    };
                });
                model.allRecipes.push(item);
            } else {
                item.recipe = [];
                model.ingredients.push(item);
            }

            var quantity = localStorage.getItem(item.id + ".quantity");
            if (quantity) {
                model.ingredientQuantities[item.id] = parseInt(quantity);
            }
            if (localStorage.getItem(item.id + ".hidden") != null) {
                model.hiddenRecipeIds.push(item.id);
            }
        });
        allItems.forEach(function (item) {
            item.cost = getCost(item.id, []);
            item.sellPrice = item.sellPrice ? item.sellPrice : 0;
            onSellPriceUpdated(item);
            item.recipe.forEach(function (ingredient) {
                ingredient.recipe = getNestedRecipe(ingredient.itemId, [item.id]);
            });
        });
        sortRecipes();
        model.ingredients.sort(function (i1, i2) {
            return i1.name > i2.name ? 1 : -1;
        });
    });
    return {
        setIngredientQuantity: function (ingredientId, quantity) {
            if (quantity == "") {
                delete model.ingredientQuantities[ingredientId];
                localStorage.removeItem(ingredientId + ".quantity");
            } else {
                var quantityInt = parseInt(quantity);
                model.ingredientQuantities[ingredientId] = quantityInt;
                localStorage.setItem(ingredientId + ".quantity", quantityInt);
            }
        },
        getHotItemRecipes: function () {
            return model.allRecipes.slice(0, -1).sort(function (r1, r2) {
                return r1.name > r2.name ? 1 : -1;
            });
        },
        setHotItemRecipe: function (hotItemNumber, hotItemId) {
            var hotItemIndex = hotItemNumber - 1;
            var previousHotItemId = model.hotItemIds[hotItemIndex];
            model.hotItemIds[hotItemIndex] = hotItemId;
            if (previousHotItemId) {
                var recipe = model.allRecipes.find(function (recipe) {
                    return recipe.id == previousHotItemId;
                });
                recipe.sellPrice /= 2;
                onSellPriceUpdated(recipe);
            }
            if (hotItemId) {
                var recipe = model.allRecipes.find(function (recipe) {
                    return recipe.id == hotItemId;
                });
                recipe.sellPrice *= 2;
                onSellPriceUpdated(recipe);
            }
            sortRecipes();
        },
        getCraftableRecipes: function () {
            return model.allRecipes.filter(function (recipe) {
                return !model.hiddenRecipeIds.includes(recipe.id);
            }).filter(function (recipe) {
                var totalQuantityByItemId = {};
                var addQuantity = function (ingredient) {
                    var previousTotal = totalQuantityByItemId[ingredient.itemId];
                    var quantity = ingredient.quantity;
                    totalQuantityByItemId[ingredient.itemId] = previousTotal ? previousTotal + quantity : quantity;
                    ingredient.recipe.forEach(addQuantity);
                };
                recipe.recipe.forEach(addQuantity);
                return Object.keys(totalQuantityByItemId).every(function (itemId) {
                    var haveQuantity = model.ingredientQuantities[itemId];
                    var needQuantity = totalQuantityByItemId[itemId];
                    return haveQuantity && haveQuantity >= needQuantity;
                });
            });
        },
        getRecipes: function () {
            return model.allRecipes.filter(function (recipe) {
                return !model.hiddenRecipeIds.includes(recipe.id);
            });
        },
        hideRecipe: function (itemId) {
            if (!model.hiddenRecipeIds.includes(itemId)) {
                model.hiddenRecipeIds.push(itemId);
                localStorage.setItem(itemId + ".hidden", "true");
            }
        },
        getHiddenRecipes: function () {
            return model.allRecipes.filter(function (recipe) {
                return model.hiddenRecipeIds.includes(recipe.id);
            });
        },
        unhideRecipe: function (itemId) {
            var index = model.hiddenRecipeIds.indexOf(itemId);
            if (index >= 0) {
                model.hiddenRecipeIds.splice(index, 1);
                localStorage.removeItem(itemId + ".hidden");
            }
        }
    };
}();

//view
(function () {
    var renderHotItemSelection = function (hotItemNumber) {
        var inputId = "hotItem" + hotItemNumber;
        var selectAttributes = {
            id: inputId,
            oninput: function (e) {
                controller.setHotItemRecipe(hotItemNumber, e.target.value);
            }
        };
        return m(".form-group.row", [
            m("label.col-6.col-form-label", { "for": inputId }, "Hot Item " + hotItemNumber),
            m(".col-6", m("select.form-control", selectAttributes, [
                m("option[value=]", "(None)"),
                controller.getHotItemRecipes().map(function (recipe) {
                    var optionAttributes = { value: recipe.id };
                    if (model.hotItemIds[hotItemNumber - 1] == recipe.id) {
                        optionAttributes.selected = "selected";
                    }
                    return m("option", optionAttributes, recipe.name);
                })
            ]))
        ]);
    };
    var renderRecipe = function (item, hide) {
        var renderNestedRecipe = function (ingredient) {
            return [
                model.allItemsById[ingredient.itemId].name + " ",
                m("span.badge.badge-secondary", ingredient.quantity),
                m("ul", ingredient.recipe.map(function (nestedIngredient) {
                    return m("li", renderNestedRecipe(nestedIngredient));
                }))
            ];
        };
        return m(".card.mb-3", [
            m(".card-header.clearfix", [
                m("h5.float-left", item.name),
                m(
                    "button.close.float-right[type=button][aria-label=Close]",
                    {
                        onclick: function () {
                            if (hide) {
                                controller.hideRecipe(item.id);
                            } else {
                                controller.unhideRecipe(item.id);
                            }
                        }
                    },
                    m("span[aria-hidden=true]", "×")
                )
            ]),
            m(".card-body", [
                m("table.table.table-sm", [
                    m("thead", m("tr", [
                        m("th[scope=col]", "Profit"),
                        m("th[scope=col]", "Markup"),
                        m("th[scope=col]", "Sell Price")
                    ])),
                    m("tbody", m("tr", [
                        m("td", item.profit),
                        m("td", item.markup),
                        m("td", item.sellPrice)
                    ]))
                ]),
                m("strong", "Recipe:"),
                m("ul.list-inline", item.recipe.map(function (ingredient) {
                    return m("li.list-inline-item.align-top.border.rounded.p-1", renderNestedRecipe(ingredient));
                }))
            ])
        ]);
    };
    var Layout = {
        view: function (vnode) {
            return [
                m("nav.navbar.navbar-expand-sm.fixed-top.navbar-light.bg-light.border-bottom", [
                    m(m.route.Link, { href: "/", class: "navbar-brand h1 mb-0" }, "What2Craft"),
                    m("button.navbar-toggler[type=button][data-toggle=collapse][data-target=#navbarSupportedContent][aria-controls=navbarSupportedContent][aria-expanded=false][aria-label=Toggle Navigation]",
                        m("span.navbar-toggler-icon")
                    ),
                    m(".collapse.navbar-collapse#navbarSupportedContent", [
                        m("ul.navbar-nav.mr-auto", [
                            m("li.nav-item",
                                m(m.route.Link, { href: "/ingredients", class: "nav-link" }, "Ingredients")
                            ),
                            m("li.nav-item",
                                m(m.route.Link, { href: "/hot", class: "nav-link" }, "Hot")
                            ),
                            m("li.nav-item",
                                m(m.route.Link, { href: "/craftable", class: "nav-link" }, "Craftable")
                            ),
                            m("li.nav-item",
                                m(m.route.Link, { href: "/all", class: "nav-link" }, "All")
                            ),
                            m("li.nav-item",
                                m(m.route.Link, { href: "/hidden", class: "nav-link" }, "Hidden")
                            )
                        ])
                    ])
                ]),
                m(".container", vnode.children)
            ];
        }
    };
    var Home = {
        view: function () {
            return [
                m("h2", "How to Use:"),
                m("dl.row", [
                    m("dt.col-3", "Ingredients"),
                    m("dd.col-9",
                        "Lists non-craftable items used to craft, and allows you to enter how many of each you have."
                    ),
                    m("dt.col-3", "Hot"),
                    m("dd.col-9",
                        "List all recipes, and allows you to select which one(s) are your island's current hot items."
                    ),
                    m("dt.col-3", "Craftable"),
                    m("dd.col-9",
                        "Lists recipes you can craft, given how many of each \"Ingredients\" items you have."
                    ),
                    m("dt.col-3", "All"),
                    m("dd.col-9",
                        "Lists all recipes (minus any you choose to hide)."
                    ),
                    m("dt.col-3", "Hidden"),
                    m("dd.col-9",
                        "Lists recipes you've previously hidden, allowing you to un-hide them."
                    )
                ])
            ];
        }
    };
    var Hot = {
        view: function () {
            return [
                renderHotItemSelection(1),
                renderHotItemSelection(2)
            ];
        }
    };
    var Ingredients = {
        view: function () {
            return [
                m("h2", "Ingredients"),
                model.ingredients.map(function (ingredient) {
                    var inputId = "ingredient_" + ingredient.id;
                    var inputAttributes = {
                        id: inputId,
                        value: model.ingredientQuantities[ingredient.id] || "",
                        oninput: function (e) {
                            controller.setIngredientQuantity(ingredient.id, e.target.value);
                        }
                    };
                    return m(".form-group.row", [
                        m("label.col-6.col-form-label", { "for": inputId }, ingredient.name),
                        m(".col-6", m("input.form-control[type=number][min=0]", inputAttributes))
                    ]);
                })
            ];
        }
    };
    var Craftable = {
        view: function () {
            return [
                m("h2", "Craftable"),
                controller.getCraftableRecipes().map(function (recipe) {
                    return renderRecipe(recipe, true);
                })
            ];
        }
    };
    var All = {
        view: function () {
            return [
                m("h2", "All"),
                controller.getRecipes().map(function (recipe) {
                    return renderRecipe(recipe, true);
                })
            ];
        }
    };
    var Hidden = {
        view: function () {
            return [
                m("h2", "Hidden"),
                controller.getHiddenRecipes().map(function (recipe) {
                    return renderRecipe(recipe, false);
                })
            ];
        }
    };
    m.route(document.body, "/", {
        "/": {
            view: function () {
                return m(Layout, m(Home));
            }
        },
        "/ingredients": {
            view: function () {
                return m(Layout, m(Ingredients));
            }
        },
        "/hot": {
            view: function () {
                return m(Layout, m(Hot));
            }
        },
        "/craftable": {
            view: function () {
                return m(Layout, m(Craftable));
            }
        },
        "/all": {
            view: function () {
                return m(Layout, m(All));
            }
        },
        "/hidden": {
            view: function () {
                return m(Layout, m(Hidden));
            }
        }
    });
})();
