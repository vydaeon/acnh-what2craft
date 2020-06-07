package net.vydaeon.animalcrossing.what2craft.web;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

@Configuration
class RootRouter {

    @Bean
    RouterFunction<?> rootRouterFunction(RootHandler handler) {
        return RouterFunctions.route()
                .GET("/", handler::serveRoot)
                .build();
    }
}

@Component
@RequiredArgsConstructor
class RootHandler {

    @Value("classpath:/static/index.html")
    private Resource indexHtml;

    Mono<ServerResponse> serveRoot(ServerRequest request) {
        return ServerResponse.ok()
                .contentType(MediaType.TEXT_HTML)
                .bodyValue(indexHtml);
    }
}
