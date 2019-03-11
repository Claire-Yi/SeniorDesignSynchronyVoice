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
var currentBalance='';
var currentName='';


var today= new Date();
var time=today.getHours();
var greeting='';


app.intent('Card Number', (conv, {number}) => {
    const theCardNumber = number.toString()
    const currRef = dbRef.doc(theCardNumber);
    return currRef.get()
           .then((snapshot) => {
                const {balance, cardNumber, cardPin, isLocked,name} = snapshot.data();
                currentCardNum = cardNumber;
                currentCardPin = cardPin;
                currentCardLocked = isLocked;
                currentBalance=balance;
                currentName=name;
                conv.ask('Your card ending in ' + theCardNumber + ' has been found, ' + currentName +'. Please enter this cards PIN to confirm');
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
           conv.close('The PIN you entered is incorrect. Please try again.');
           return null;
        }

});


app.intent('Lock Card', (conv) => {
	if (currentCardLocked) {
		conv.ask('Your card ending in ' + currentCardNum.toString() + ' was already locked. Is there anything else you need?');
	} else {
		const currRef = dbRef.doc(currentCardNum.toString());
        var updateSingle = currRef.update({isLocked: true});
        currentCardLocked = true;
		conv.ask('Your card ending in ' + currentCardNum.toString() + ' is now locked. You can call 8608178983 to report a fraud.');
	}
});

app.intent('Unlock Card', (conv) => {
    if (currentCardLocked) {
        const currRef = dbRef.doc(currentCardNum.toString());
        var updateSingle = currRef.update({isLocked: false});
        currentCardLocked = false;
        conv.ask('Your card ending in ' + currentCardNum.toString() + ' is now unlocked. Is there anything else you need?');
    } else {
        conv.ask('Your card ending in ' + currentCardNum.toString() + ' was already unlocked. Is there anything else I can help with?');
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

                theResponse = theResponse + 'Anything else you need help with?';
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
                conv.ask('You owe $' + String(theTotalPrice) + '. What would you like to do, ' + currentName + '?');
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
                conv.close('There was an error, please try again, ' + currentName + '.');
                return null;
            });



});



app.intent('Change Pin', (conv, {theNumber}) => {
	const currRef = dbRef.doc(currentCardNum.toString());
    var updateSingle = currRef.update({cardPin: theNumber.toString()});
	conv.ask('Your pin has been changed to ' + theNumber.toString() +' Is there anything else you need, ' + currentName +'?');
});



app.intent('Make Payment', (conv, {number})=> {
    var response='';
    if (currentCardLocked) {
      conv.ask('You card ending in ' +currentCardNum.toString() + ' is locked. Please unlock your card first to make a payment. Good bye! ');
      return null;
    }else{
      var minPayment=(parseFloat(currentBalance)/100 ) * 1.5;
      response='Your total balance is $' + String(currentBalance) + 'Your minimum payment is $' + String(minPayment);
      const amountPaid = number.toString();
      var newBal=parseFloat(currentBalance) - parseFloat(amountPaid);
      var updateSingle = currBal.update({balance: String(newBal)});
      response=response+'Your payment of $ ' + String(amountPaid) + 'has been issued. Your new current balance is $' + String(newBal);
      conv.ask(response+'Anything else you need?');
      return null;
    }
});


app.intent('Help', (conv, input)=> {
  var response='';
  if (input === 'Who are you?') {
    response=greeting +  "I'm a virtual financial assistant." +
    "I'm always here to answer your questions, help you stay on top of your finances and make everyday baking easier";
  }
  response=greeting + 'I can help with things like making a payment, checking your balance, locking or unlocking your card, or checking your past transactions. ';
  response=response+ 'What would you like to do?';
  conv.ask(response);
});

app.intent('Default Welcome Intent', (conv) => {
  if (time < 5){
    greeting='Hello! ';
  } else if(time < 12){
    greeting='Good morning! ';
  }else if(time <18){
    greeting='Good afternoon! ';
  }else if(time <23){
    greeting='Good evening! ';
  }else{
    greeting='Hi! ';
  }
  conv.ask(greeting+'Please say the last four digits of your card number. ');
});



// Set the DialogflowApp object to handle the HTTPS POST request.
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);
