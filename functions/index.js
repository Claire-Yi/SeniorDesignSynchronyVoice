'use strict';

// Import the Dialogflow module from the Actions on Google client library.
const {dialogflow} = require('actions-on-google');

// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');

// Instantiate the Dialogflow client.
const app = dialogflow({debug: true});

const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();
const dbRef = db.collection('Cards');

var currentCardNum = '';
var currentCardPin = '';
var currentCardLocked = false;


app.intent('Card Number', (conv, {number}) => {
    const theCardNumber = number.toString()
    const currRef = dbRef.doc(theCardNumber);
    return currRef.get()
           .then((snapshot) => {
                const {cardNumber, cardPin, isLocked} = snapshot.data();
                currentCardNum = cardNumber;
                currentCardPin = cardPin;
                currentCardLocked = isLocked;
                conv.ask('Your card ending in ' + theCardNumber + ' has been found. Please enter this cards PIN to confirm');
                return null;
            }).catch((e) => {
                conv.close('The card ending in ' + theCardNumber + ' has not been found.');
                return null;
            });
});

app.intent('Card Pin', (conv, {number}) => {
        const actualPin = currentCardPin;
        const pinToCheck = number.toString();
        if (pinToCheck === actualPin) {
           conv.ask('Your PIN has been confirmed. What would you like to know about this card?');
        } else {
           conv.close('The PIN you entered is incorrect. Goodbye.');
        }
    
});


app.intent('Lock Card', (conv) => {
	if (currentCardLocked) {
		conv.ask('Your card ending in ' + currentCardNum.toString() + ' was already locked. Is there anything else you need?');
	} else {
		const currRef = dbRef.doc(currentCardNum.toString());
        var updateSingle = currRef.update({isLocked: true});
        currentCardLocked = true;
		conv.ask('Your card ending in ' + currentCardNum.toString() + ' is now locked. Is there anything else you need?');
	}
});

app.intent('Unlock Card', (conv) => {
    if (currentCardLocked) {
        const currRef = dbRef.doc(currentCardNum.toString());
        var updateSingle = currRef.update({isLocked: false});
        currentCardLocked = false;
        conv.ask('Your card ending in ' + currentCardNum.toString() + ' is now unlocked. Is there anything else you need?');
    } else {
        conv.ask('Your card ending in ' + currentCardNum.toString() + ' was already unlocked. Is there anything else you need?');
    }
});


app.intent('Search Transaction', (conv, {Product}) => {
           const theProduct = Product.toLowerCase()
           const currRef = dbRef.doc(currentCardNum.toString()).collection('Transactions');
           var theResponse = 'In regards to ' + theProduct + ': ';
           return currRef.where('Item', '==', theProduct).get()
           .then((snapshot) => {
                if (snapshot.empty) {
                    conv.ask('The card ending in ' + currentCardNum.toString() + ' has no recent transactions regarding ' + theProduct);
                    conv.ask('Anything else you need?');
                    return null;
                }
                 
                snapshot.forEach(doc => {
                    const {Date, Item, Price, Timestamp} = doc.data();
                    theResponse = theResponse + 'There was a transaction on ' + Date + ' for $' + Price + '. ';
                });
                 
                theResponse = theResponse + 'Anything else you need?';
                conv.ask(theResponse);
                return null;
            }).catch((e) => {
                console.log('error:', e);
                conv.close('There was an error, please try again.');
                return null;
            });
});


app.intent('Current Balance', (conv) => {
           const currRef = dbRef.doc(currentCardNum.toString()).collection('Transactions');
           var theTotalPrice = 0.0;
           return currRef.get()
           .then((snapshot) => {                 
                snapshot.forEach(doc => {
                    const {Date, Item, Price, Timestamp} = doc.data();
                    theTotalPrice = theTotalPrice + parseFloat(Price);
                });
				theTotalPrice = Math.round(theTotalPrice * 100) / 100;
                conv.ask('After reviewing your transactions, you owe $' + String(theTotalPrice) + '. Is there anything else you need?');
                return null;
            }).catch((e) => {
                console.log('error:', e);
                conv.close('There was an error, please try again.');
                return null;
            });
});

app.intent('SearchByDate', (conv, {theNumber, DateString}) => {

	var today = new Date();
	var currTimeStamp = Math.round((new Date()).getTime() / 1000);
	var dd = today.getDate();
	var mm = today.getMonth();
	var timeToCheck = currTimeStamp;
	var theResponse = 'In regards to that time frame: ';

	console.log(theNumber);
	console.log(DateString);
	
	if (DateString === 'day' || DateString === 'night') {
		timeToCheck = timeToCheck - 24*60*60;
	}
	if (DateString === 'week') {
		timeToCheck = timeToCheck - 24*60*60*7;
	}
	if (DateString === 'month') {
		timeToCheck = timeToCheck - 24*60*60*7*4;
	}
	
	if (DateString === 'days' || DateString === 'nights') {
		timeToCheck = timeToCheck - 24*60*60*theNumber;
	}
	if (DateString === 'weeks') {
		timeToCheck = timeToCheck - 24*60*60*7*theNumber;
	}
	if (DateString === 'months') {
		timeToCheck = timeToCheck - 24*60*60*7*4*theNumber;
	}
	
	
	const currRef = dbRef.doc(currentCardNum.toString()).collection('Transactions');
    return currRef.where('Timestamp', '>=', timeToCheck).get()
           .then((snapshot) => {
                if (snapshot.empty) {
                    conv.ask('The card ending in ' + currentCardNum.toString() + ' has no transactions in that timeframe. ');
                    conv.ask('Anything else you need?');
                    return null;
                }
                 
                snapshot.forEach(doc => {
                    const {Date, Item, Price, Timestamp} = doc.data();
                    theResponse = theResponse + 'There was a transaction on ' + Date + ' for $' + Price + '. ';
                });
                 
                theResponse = theResponse + 'Anything else you need?';
                conv.ask(theResponse);
                return null;
            }).catch((e) => {
                console.log('error:', e);
                conv.close('There was an error, please try again.');
                return null;
            });


       
});



app.intent('Change Pin', (conv, {theNumber}) => {
	const currRef = dbRef.doc(currentCardNum.toString());
    var updateSingle = currRef.update({cardPin: theNumber.toString()});
	conv.ask('Your pin has been changed to ' + theNumber.toString() +' Is there anything else you need?');
});


// Set the DialogflowApp object to handle the HTTPS POST request.
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);
