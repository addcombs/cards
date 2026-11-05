package com.acombsdev.cards.card;

import com.acombsdev.cards.security.AccountSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = CardController.class, properties = "app.cors.allowed-origins=https://app.example")
@Import(AccountSecurityConfig.class)
class CardControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean CardRepository repository;
    @MockitoBean JwtDecoder decoder;

    @Test
    void requiresAnAuthenticatedIdentity() throws Exception {
        mvc.perform(get("/api/cards")).andExpect(status().isUnauthorized());
        verifyNoInteractions(repository);
    }

    @Test
    void allowsCrossOriginCallsOnlyFromConfiguredOrigins() throws Exception {
        mvc.perform(options("/api/cards").header("Origin", "https://app.example")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://app.example"));
        mvc.perform(options("/api/cards").header("Origin", "https://other.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    @Test
    void listsTheCardsInRepositoryOrder() throws Exception {
        when(decoder.decode("valid")).thenReturn(Jwt.withTokenValue("valid").header("alg", "RS256")
                .subject("subject").claim("email", "user@example.com").build());
        when(repository.findAllByOrderByYearAscSetNameAscCardNumberAscIdAsc()).thenReturn(List.of(
                new Card("order-1-r01", "97041266", "Baseball", 1968, "Topps", "177", "Jerry Koosman / Nolan Ryan",
                        "Mets Rookies", "VG-EX 4"),
                new Card("94481237", "94481237", "Basketball", 1992, "Topps Gold", "141", "Michael Jordan", null,
                        "EX-MT 6")));
        mvc.perform(get("/api/cards").header("Authorization", "Bearer valid"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].photoId").value("order-1-r01"))
                .andExpect(jsonPath("$[0].sport").value("Baseball"))
                .andExpect(jsonPath("$[0].variety").value("Mets Rookies"))
                .andExpect(jsonPath("$[1].player").value("Michael Jordan"))
                .andExpect(jsonPath("$[1].cardNumber").value("141"))
                .andExpect(jsonPath("$[1].grade").value("EX-MT 6"));
    }
}
