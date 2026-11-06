package com.acombsdev.cards.card;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** A card's editable details; its photo ID is fixed because it names the card's photos. Blank optional values are
 * stored as null, and the eBay listing must be an http(s) URL so the UI can link to it safely. */
public record CardRequest(
        @Size(max = 20) String certNumber,
        @NotNull @Pattern(regexp = "Baseball|Basketball|Football|Hockey") String sport,
        @NotNull @Min(1800) @Max(2100) Integer year,
        @NotBlank @Size(max = 255) String setName,
        @NotBlank @Size(max = 20) String cardNumber,
        @NotBlank @Size(max = 255) String player,
        @Size(max = 255) String variety,
        @Size(max = 20) String grade,
        @Size(max = 2048) @Pattern(regexp = "\\s*(https?://\\S+)?\\s*") String ebayUrl
) {
}
