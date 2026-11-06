package com.acombsdev.cards.card;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/cards")
@Tag(name = "Cards", description = "The sports card collection")
// The cognitoIdToken scheme is declared on AccountController.
@SecurityRequirement(name = "cognitoIdToken")
public class CardController {
    private final CardRepository repository;

    public CardController(CardRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    @Operation(summary = "List the cards",
            description = "Every card, oldest first, with its sport for the UI's tabs and the photo ID of its front and back.")
    public List<CardResponse> list() {
        return repository.findAllByOrderByYearAscSetNameAscCardNumberAscIdAsc().stream().map(CardResponse::from).toList();
    }

    @PutMapping("/{photoId}")
    @Transactional
    @Operation(summary = "Edit a card's details",
            description = "Only for members of the Cognito admins group (403 otherwise). 404 for an unknown photo ID; 409 if the cert number belongs to another card.")
    public CardResponse update(@PathVariable String photoId, @Valid @RequestBody CardRequest request) {
        Card card = repository.findByPhotoId(photoId)
                .orElseThrow(() -> new EntityNotFoundException("Card not found."));
        card.update(request);
        return CardResponse.from(repository.saveAndFlush(card));
    }
}
