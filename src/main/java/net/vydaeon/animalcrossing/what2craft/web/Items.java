package net.vydaeon.animalcrossing.what2craft.web;

import lombok.RequiredArgsConstructor;
import net.vydaeon.animalcrossing.what2craft.Item;
import net.vydaeon.animalcrossing.what2craft.ItemRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

@Configuration
class ItemsRouter {

    @Bean
    RouterFunction<?> itemsRouterFunction(ItemsHandler handler) {
        return RouterFunctions.route()
                .GET("/items", handler::getAllItems)
                .build();
    }
}

@Component
@RequiredArgsConstructor
class ItemsHandler {

    private final ItemRepository repository;

    Mono<ServerResponse> getAllItems(ServerRequest request) {
        return ServerResponse.ok()
                .body(repository.findAll(), Item.class);
    }
}
