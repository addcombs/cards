package com.acombsdev.cards.card;

import com.acombsdev.cards.security.AccountSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = CardController.class, properties = "app.cors.allowed-origins=https://app.example")
@Import({AccountSecurityConfig.class, com.acombsdev.cards.user.ApiExceptionHandler.class})
class CardControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean CardRepository repository;
    @MockitoBean JwtDecoder decoder;

    private static final String EDIT = """
            {"certNumber": " 97041266 ", "sport": "Baseball", "year": 1968, "setName": "Topps", "cardNumber": "177",
             "player": "Nolan Ryan", "variety": " ", "grade": "EX 5",
             "ebayUrl": " https://www.ebay.com/itm/123 "}""";

    private void token(String value, List<String> groups) {
        var jwt = Jwt.withTokenValue(value).header("alg", "RS256").subject("subject").claim("email", "user@example.com");
        if (groups != null) jwt.claim("cognito:groups", groups);
        when(decoder.decode(value)).thenReturn(jwt.build());
    }

    private static Card koosmanRyan() {
        return new Card("order-1-r01", "97041266", "Baseball", 1968, "Topps", "177", "Jerry Koosman / Nolan Ryan",
                "Mets Rookies", "VG-EX 4");
    }

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
        token("valid", null);
        when(repository.findAllByOrderByYearAscSetNameAscCardNumberAscIdAsc()).thenReturn(List.of(
                koosmanRyan(),
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

    @Test
    void letsOnlyAdminsEditCards() throws Exception {
        token("member", List.of("collectors"));
        token("none", null);
        for (String token : List.of("member", "none")) {
            mvc.perform(put("/api/cards/order-1-r01").header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON).content(EDIT))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(put("/api/cards/order-1-r01").contentType(MediaType.APPLICATION_JSON).content(EDIT))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(repository);
    }

    @Test
    void savesAnAdminsEditTrimmingBlankValuesToNull() throws Exception {
        token("admin", List.of("admins"));
        when(repository.findByPhotoId("order-1-r01")).thenReturn(Optional.of(koosmanRyan()));
        when(repository.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        mvc.perform(put("/api/cards/order-1-r01").header("Authorization", "Bearer admin")
                        .contentType(MediaType.APPLICATION_JSON).content(EDIT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photoId").value("order-1-r01"))
                .andExpect(jsonPath("$.certNumber").value("97041266"))
                .andExpect(jsonPath("$.player").value("Nolan Ryan"))
                .andExpect(jsonPath("$.variety").doesNotExist())
                .andExpect(jsonPath("$.grade").value("EX 5"))
                .andExpect(jsonPath("$.ebayUrl").value("https://www.ebay.com/itm/123"));
    }

    @Test
    void rejectsUnknownCardsAndInvalidDetails() throws Exception {
        token("admin", List.of("admins"));
        when(repository.findByPhotoId("missing")).thenReturn(Optional.empty());
        mvc.perform(put("/api/cards/missing").header("Authorization", "Bearer admin")
                        .contentType(MediaType.APPLICATION_JSON).content(EDIT))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/cards/order-1-r01").header("Authorization", "Bearer admin")
                        .contentType(MediaType.APPLICATION_JSON).content(EDIT.replace("Baseball", "Golf")))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/cards/order-1-r01").header("Authorization", "Bearer admin")
                        .contentType(MediaType.APPLICATION_JSON).content(EDIT.replace("https://", "javascript:")))
                .andExpect(status().isBadRequest());
        verify(repository, never()).saveAndFlush(any());
    }
}
